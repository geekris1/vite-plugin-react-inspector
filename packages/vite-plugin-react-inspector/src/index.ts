import type { Connect, Plugin } from 'vite'
import { parseSync, traverse } from '@babel/core'
import MagicString from 'magic-string'
import { queryParserMiddleware } from './middleware'
import { parseJSXIdentifier } from './utils'
import { launchEditor } from './launch-editor'
function VitePluginReactInspector(): Plugin {
  return {
    name: 'vite-plugin-react-inspector',
    enforce: 'pre',
    apply: 'serve',
    config: () => {
      return {
        optimizeDeps: {
          include: ['react-dom'],
        },
      }
    },
    transform: (code, id) => {
      if (id.endsWith('.tsx')) {
        const transformedCode = code
        const s = new MagicString(transformedCode)
        const ast = parseSync(code, {
          configFile: false,
          filename: id,
          ast: true,
          presets: [
            '@babel/preset-env',
            '@babel/preset-react',
            '@babel/preset-typescript',
          ],
        })
        traverse(ast, {
          enter({ node }) {
            if (node.type === 'JSXElement') {
              const { start } = node
              const { column, line } = node?.loc?.start as any
              const toInsertPosition = start + parseJSXIdentifier(node.openingElement.name as any).length + 1
              const content = ` data-react-inspector="${id}:${line}:${column}"`
              s.appendLeft(toInsertPosition, content)
            }
          },
        })
        const sourceMap = s.generateMap({
          source: id,
          includeContent: true,
        })
        return {
          code: s.toString(),
          map: sourceMap,
        }
      }
    },
    configureServer: (server) => {
      type RequestMessage = Parameters<Connect.NextHandleFunction>[0]
      server.middlewares.use(queryParserMiddleware)
      server.middlewares.use((req: RequestMessage & { query?: object }, res, next) => {
        // custom handle request...
        if (req.url?.startsWith('/__react-inspector-launch-editor')) {
          const { file } = req?.query as any
          if (file) {
            const [filePath, line, column] = file.split(':')
            launchEditor(filePath, Number(line), Number(column))
          }
          next()
        }
        else {
          next()
        }
      })
    },
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            injectTo: 'body',
            attrs: {
              type: 'module',
              src: '/node_modules/vite-plugin-react-inspector/src/inject.jsx',
            },
          },
        ],
      }
    },
  }
}

export default VitePluginReactInspector
