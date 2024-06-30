import process from 'node:process'
import { execSync } from 'node:child_process'
import { defineValaxyAddon } from 'valaxy'
import consola from 'consola'
import { blue, bold, dim, green, magenta, underline, yellow } from 'picocolors'
import pkg from '../package.json'
import { getContributors } from '../utils'
import type { GitLogOptions } from '../types'

export const addonGitLog = defineValaxyAddon<GitLogOptions>(options => ({
  name: pkg.name,
  enable: true,
  options,

  setup(valaxy) {
    let contributorMode = options!.contributor?.mode || 'log'
    const tty = process.platform === 'win32' ? 'CON' : '/dev/tty'

    valaxy.hook('build:before', () => {
      try {
        if (!options?.debug)
          return
        consola.info(`${yellow('valaxy-addon-git-log')}: ${blue('Platform')}: ${process.platform}`)
        consola.info(`${yellow('valaxy-addon-git-log')}: ${execSync('git --version')}`)
        consola.info(execSync(
          `git log --no-merges --max-count=30 --pretty="format:${dim(green('%ar'))} ${bold(magenta('%h'))} ${bold(green('%an'))} ${bold(yellow('%s'))}"`,
          { encoding: 'utf-8' },
        ))
      }
      catch (error) {
        consola.error(`${yellow('valaxy-addon-git-log')} encountered an error: ${error}`)
      }
    })

    valaxy.hook('vue-router:extendRoute', async (route) => {
      const filePath = route.components.get('default') as string
      if (filePath) {
        // Only allow files from the user's working directory 'pages' folder
        const currentWorkingDirectory = `${process.cwd()}/pages`
        if (!filePath.startsWith(currentWorkingDirectory))
          return

        let debugInfo = `${yellow('valaxy-addon-git-log(debug):\n')}`

        debugInfo += ` ${dim('├─')} ${blue('FilePath')}: ${underline(filePath)}\n`

        try {
          const contributors = getContributors(filePath, contributorMode, tty)
          debugInfo += ` ${dim('└─')} ${blue('Contributors')}: ${JSON.stringify(contributors)}\n`
          debugInfo += `${execSync(`git log --no-merges --first-parent --follow -- ${filePath}`, { encoding: 'utf-8' })}`

          if (!route.meta.frontmatter.gitLogs)
            route.meta.frontmatter.gitLogContributors = []

          contributors.forEach((contributor) => {
            route.meta.frontmatter.gitLogContributors.push(contributor)
          })

          // Output debug information based on configuration or environment variables
          if (options?.debug !== false)
            (options?.debug ? consola.info : consola.debug)(debugInfo)
        }
        catch (error: any) {
          if (process.platform === 'linux' && error.message.includes(tty)) {
            consola.warn(`${yellow('valaxy-addon-git-log')}: The path ${tty} does not exist`)
            contributorMode = 'log'
          }
          else {
            consola.error(`${yellow('valaxy-addon-git-log')}: ${error}`)
          }
        }
      }
    })
  },
}))
