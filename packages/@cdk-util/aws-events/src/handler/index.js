const { codebuildHandler } = require('./codebuildHandler');
const { codepipelineHandler } = require('./codepipelineHandler');
const { glueHandler } = require('./glueHandler');
const { ssmHandler } = require('./ssmHandler');

const eventHandlers = {
  'aws.codebuild': codebuildHandler,
  'aws.codepipeline': codepipelineHandler,
  'aws.glue': glueHandler,
  'aws.ssm': ssmHandler,
};

const unsupportedEventHandler = (event, context, callback) => {
  console.log(`Event source '${event.source}' is not supported`);

  return callback(null);
};

exports.handler = (event, context, callback) => {
  const handler = eventHandlers[event.source] || unsupportedEventHandler;

  handler(event, context, callback);
};
