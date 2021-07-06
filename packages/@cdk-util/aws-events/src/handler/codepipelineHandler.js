const { postSlackMessage } = require('./postSlackMessage');
const { COLOR_MAP } = require('./constants');

exports.codepipelineHandler = (event, context, callback) => {
  const {
    time,
    region,
    detail: {
      pipeline,
      state,
    },
  } = event;

  const title = `Pipeline \`${pipeline}\` is ${state}`;

  postSlackMessage({
    text: title,
    attachments: [
      {
        title,
        title_link: `https://${region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${pipeline}/view`,
        color: COLOR_MAP[state] || 'danger',
        ts: Date.parse(time) / 1000,
      },
    ],
  }, callback);
};
