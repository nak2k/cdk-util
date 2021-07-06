const { postSlackMessage } = require('./postSlackMessage');
const { COLOR_MAP } = require('./constants');

exports.ssmHandler = (event, context, callback) => {
  const {
    time,
    region,
    detail: {
      'command-id': commandId,
      'document-name': DocumentName,
      'instance-id': instanceId,
      status,
    },
  } = event;

  const title = `${status}: SSM Run Command \`${DocumentName}\``;

  postSlackMessage({
    text: title,
    attachments: [
      {
        title,
        title_link: `https://${region}.console.aws.amazon.com/systems-manager/run-command/${commandId}/${instanceId}`,
        color: COLOR_MAP[status.toUpperCase()] || 'danger',
        ts: Date.parse(time) / 1000,
      },
    ],
  }, callback);
};
