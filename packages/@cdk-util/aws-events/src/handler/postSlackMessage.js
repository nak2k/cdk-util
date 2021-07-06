const { request } = require('https');
const { parse } = require('url');

const SLACK_WEBHOOK_URL_OBJ = parse(process.env.SLACK_WEBHOOK_URL);

function postSlackMessage(message, callback) {
  if (!message.channel) {
    const { SLACK_CHANNEL } = process.env;

    SLACK_CHANNEL && (message.channel = SLACK_CHANNEL);
  }

  request({ ...SLACK_WEBHOOK_URL_OBJ, method: 'POST' }, res => {
    res.on('end', () => callback(null, {}));
  })
    .on('error', callback)
    .end(JSON.stringify(message));
}

exports.postSlackMessage = postSlackMessage;
