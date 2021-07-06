const { postSlackMessage } = require('./postSlackMessage');
const { COLOR_MAP } = require('./constants');
const AWS = require('aws-sdk');

exports.codebuildHandler = (event, context, callback) => {
  const {
    time,
    region,
    detail: {
      'build-status': buildStatus,
      'project-name': projectName,
      'build-id': buildId,
      'current-phase': currentPhase,
      'additional-information': {
        logs: {
          'group-name': logGroupName,
          'stream-name': logStreamName,
          // 'deep-link': deepLink,
        },
      },
    },
  } = event;

  if (currentPhase !== 'SUBMITTED' && currentPhase !== 'COMPLETED') {
    if (buildStatus !== 'IN_PROGRESS' && buildStatus !== 'SUCCEEDED') {
      return;
    }
  }

  const resourceOfBuildId = buildId.substr(buildId.indexOf('build/'));

  const title = `${buildStatus}: Build \`${projectName}\``;

  const color = COLOR_MAP[buildStatus] || 'danger';

  const message = {
    text: title,
    attachments: [
      {
        title,
        title_link: `https://${region}.console.aws.amazon.com/codesuite/codebuild/projects/${projectName}/${resourceOfBuildId}/log`,
        color,
        ts: Date.parse(time) / 1000,
        fields: [
          {
            title: 'Phase',
            value: currentPhase,
            short: true,
          },
        ],
      },
    ],
  };

  if (buildStatus !== 'FAILED') {
    return postSlackMessage(message, callback);
  }

  /*
   * Add an error information to the message.
   */
  const logs = new AWS.CloudWatchLogs();

  const params = {
    logGroupName,
    logStreamName,
    limit: 100,
  };

  logs.getLogEvents(params, (err, data) => {
    if (err) {
      return callback(err);
    }

    const text = data.events.map(({ message }) => message).join('\n');

    message.attachments.push({
      color,
      text,
    });

    const { SLACK_ERROR_CHANNEL } = process.env;

    SLACK_ERROR_CHANNEL && (message.channel = SLACK_ERROR_CHANNEL);

    postSlackMessage(message, callback);
  });
};
