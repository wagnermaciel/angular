/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

/**
 * **Usage:**
 * ```
 * node rebase-pr <github-repository> <pull-request-number>
 * ```
 * **Example:**
 * ```
 * node rebase-pr 123
 * ```
 *
 * Rebases the current branch on top of the GitHub PR target branch.
 *
 * **Context:**
 * Since a GitHub PR is not necessarily up to date with its target branch, it is useful to rebase
 * prior to testing it on CI to ensure more up to date test results.
 *
 * **Implementation details:**
 * This script obtains the base for a GitHub PR via the
 * [GitHub PR API](https://developer.github.com/v3/pulls/#get-a-single-pull-request), then
 * fetches that branch, and rebases the current branch on top of it.
 *
 * **NOTE:**
 * This script cannot use external dependencies or be compiled because it needs to run before the
 * environment is setup.
 * Use only features supported by the NodeJS versions used in the environment.
 */

// This script uses `console` to print messages to the user.
// tslint:disable:no-console

// Imports
const util = require('util');
const child_process = require('child_process');
const exec = util.promisify(child_process.exec);
const {determineTargetRefAndSha} = require('./get-pr-refs-and-sha');


const windowsFileMatchers = [
  /third_party\/*/,
  /packages\/compiler-cli\/*/
];

// Run
_main(...process.argv.slice(2)).catch(err => {
  console.error(err);
  process.exitCode = 1;
});

// Helpers
async function _main(prNumber) {
  console.log(`Getting refs and SHAs for PR ${prNumber}.`);
  const target = await determineTargetRefAndSha(prNumber);
  console.log(`Fetching target branch: ${target.baseRef}.`);
  await exec(`git fetch origin ${target.baseRef}`);

  // The sha of the latest commit on the target branch.
  const {stdout: shaOfTargetBranchLatest} = await exec(`git rev-parse origin/${target.baseRef}`);
  // The sha of the latest commit on the PR.
  const {stdout: shaOfPRLatest} = await exec(`git rev-parse HEAD`);
  // The first common SHA in the history of the target branch and the latest commit in the PR.
  const {stdout: commonAncestorSha} =
      await exec(`git merge-base origin/${target.baseRef} ${shaOfPRLatest}`);

  // Log known refs and shas
  console.log(`--------------------------------`);
  console.log(`    Target Branch:                   ${target.baseRef}`);
  console.log(`    Latest Commit for Target Branch: ${shaOfTargetBranchLatest.trim()}`);
  console.log(`    Latest Commit for PR:            ${shaOfPRLatest.trim()}`);
  console.log(`    First Common Ancestor SHA:       ${commonAncestorSha.trim()}`);
  console.log(`--------------------------------`);
  console.log();


  // Get the count of commits between the latest commit from origin and the common ancestor SHA.
  const {stdout: commitCount} =
      await exec(`git rev-list --count origin/${target.baseRef}...${shaOfPRLatest.trim()}`);
  const {stdout: changedFilesString} = await exec(
        `git diff --name-only origin/${target.baseRef} ${shaOfPRLatest.trim()}`);
  const changedFiles = changedFilesString.split('\n');
  console.log(`Checking ${changedFiles.length} files across ${commitCount.trim()} commits.`);

  const fileResults = {matched: [], unmatched: []};
  for (let file of changedFiles) {
    const affectsWindows = windowsFileMatchers.some(regex => regex.test(file));
    if (affectsWindows) {
      fileResults.matched.push(file)
    } else {
      fileResults.unmatched.push(file)
    }
  }

  console.groupCollapsed('Unmatched Files');
  for (let file of fileResults.unmatched) { console.info(file) }
  console.groupEnd();
  console.groupCollapsed('Matched Files');
  for (let file of fileResults.matched) { console.info(file) }
  console.groupEnd();

  if (fileResults.matched.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}
