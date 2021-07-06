const { postSlackMessage } = require('./postSlackMessage');
const { COLOR_MAP } = require('./constants');

exports.glueHandler = (event, context, callback) => {
  const {
    time,
    region,
    detail: {
      jobName,
      state,
      jobRunId,
      message,
    },
  } = event;

  const title = `${state}: Glue job \`${jobName}\``;

  const color = COLOR_MAP[state] || 'danger';

  const slackMessage = {
    text: title,
    attachments: [
      {
        title,
        title_link: `https://${region}.console.aws.amazon.com/glue/home#jobRun:jobName=${jobName};jobRunId=${jobRunId}`,
        color,
        ts: Date.parse(time) / 1000,
        fields: [
          {
            title: 'Message',
            value: message,
          },
        ],
      },
    ],
  };

  if (state !== 'SUCCEEDED') {
    const { SLACK_ERROR_CHANNEL } = process.env;

    SLACK_ERROR_CHANNEL && (slackMessage.channel = SLACK_ERROR_CHANNEL);
  }

  postSlackMessage(slackMessage, callback);
};
