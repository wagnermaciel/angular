
const https = require('https');

async function requestDataFromGithub(url) {
  // GitHub requires a user agent: https://developer.github.com/v3/#user-agent-required
  const options = {headers: {'User-Agent': 'angular'}};

  return new Promise((resolve, reject) => {
    https
        .get(
            url, options,
            (res) => {
              const {statusCode} = res;
              const contentType = res.headers['content-type'];
              let rawData = '';

              res.on('data', (chunk) => { rawData += chunk; });
              res.on('end', () => {
                let error;
                if (statusCode !== 200) {
                  error = new Error(
                      `Request Failed.\nStatus Code: ${statusCode}.\nResponse: ${rawData}`);
                } else if (!/^application\/json/.test(contentType)) {
                  error = new Error(
                      'Invalid content-type.\n' +
                      `Expected application/json but received ${contentType}`);
                }

                if (error) {
                  reject(error);
                  return;
                }

                try {
                  resolve(JSON.parse(rawData));
                } catch (e) {
                  reject(e);
                }
              });
            })
        .on('error', (e) => { reject(e); });
  });
}

exports.determineTargetRefAndSha = async function(prNumber) {
  const pullsUrl = `https://api.github.com/repos/angular/angular/pulls/${prNumber}`;

  const result = await requestDataFromGithub(pullsUrl);
  return {
    baseRef: result.base.ref,
    baseSha: result.base.sha,
    headRef: result.head.ref,
    headSha: result.head.sha,
  };
}
