const catchAsync = (fn) => (req, res, next) => {
  // .catch(err => next(err)) can be shorted into just .catch(next)
  fn(req, res, next).catch(next);
};
module.exports = catchAsync;
