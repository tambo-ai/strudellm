/**
 * Application configuration constants
 */

export const config = {
  /** GitHub repository URL for issues and feedback */
  githubRepo: "https://github.com/tambo-ai/strudellm",

  /** GitHub issues URL */
  get githubIssues() {
    return `${this.githubRepo}/issues`;
  },

  /** GitHub new issue URL */
  get githubNewIssue() {
    return `${this.githubRepo}/issues/new`;
  },
} as const;
