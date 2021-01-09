const debug = require('debug');

exports.handler = async (_event, _context) => {
  return {
    debug: !!debug,
  };
}
