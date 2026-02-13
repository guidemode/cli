import chalk from 'chalk'

/** Colored >> prefix: orange > green > */
export const PREFIX = `${chalk.hex('#FF8C00')('>')}${chalk.hex('#22C55E')('>')}`

/** Prefix a title string with the branded >> */
export function brandTitle(text: string): string {
  return `${PREFIX} ${text}`
}
