const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  // I forgot to return this at first, so I got null token below
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.secure = true;
  }
  res.cookie('jwt', token, cookieOptions);
  // remove password field from output:
  user.password = undefined;
  // status code 201 for created
  res.status(statusCode).json({ status: 'success', token, data: { user } });
};

const signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    // only the above 4 in after section 13 source code online
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
    passwordResetToken: req.body.passwordResetToken,
    passwordResetExpires: req.body.passwordResetExpires,
    // active: req.body.active,
  });
  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();
  createSendToken(newUser, 201, res);
});

const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // 1. check if email and password exist
  if (!email || !password) {
    // error status code 400 for a bad request
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2. check if user exists and password is correct
  // need to explicitly select the password field so that the password field is back in our const user;
  // in the userModel, we use select: false on password, so password will not be shown when we get all users.
  const user = await User.findOne({ email: email }).select('+password');
  if (!user || !(await user.correctPassword(password, user.password))) {
    // status code 401 means bad authorization
    return next(new AppError('Incorrect email or password!', 401));
  }
  // 3. if everything is ok, send the jwt to the client
  createSendToken(user, 200, res);
  // const token = signToken(user._id);
  // //   const token = '1234hello';
  // res.status(200).json({ status: 'success', token });
});

const logout = (req, res) => {
  // res.cookie('jwt', 'loggedout', {
  //   expires: new Date(Date.now() + 1000),
  //   httpOnly: true,
  // });
  res.clearCookie('jwt');
  res.status(200).json({ status: 'success' });
  // location.reload();
};

// only for rendered page, no errors
const isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1. verify cookie
      // decoded will be the payload/data of the jwt
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      // 2. check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // 3. check if user changed password after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }
      // 4. then, there is a logged in user
      // every pug template will have access to res.locals, and user is the name of the variable pug cam access to.
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      next();
    }
  }
  next();
};

const protect = catchAsync(async (req, res, next) => {
  let token;
  // 1. get the JWT and check if it is there
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    /// this is block scoped in ES6, so we will want to define token outside the if block
    // const token = req.headers.authorization.split(' ')[1];
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! please log in to get access!', 401)
    );
  }
  // 2.verification token
  // decoded will be the payload/data of the jwt
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // 3. check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belonging to this token no longer exists!', 401)
    );
  }
  // 4.check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401)
    );
  }
  /// then, finally, we can grant access to proteced routes
  req.user = currentUser; // might be useful in the future,
  // console.log(currentUser);
  res.locals.user = currentUser;
  // put some staff on the req object, amd then this data would be available at a later point for a latter middleware
  next();
});

// how to define middleware functions which have parameters
const restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        // 403 status code means forbidden, no authorization
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };

const forgotPassword = catchAsync(async (req, res, next) => {
  // 1. get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address'), 404);
  }
  // 2.generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  // <----- really important note here ---->
  // the reason we want validateBeforeSave: false is that, when we fetch the user
  // from above, the passwordConfirm field was set to undefined in a middleware in userModel.js,
  // hence, after we update the passwordResetToken and passwordResetExpires fields in
  // the createPasswordResetToken function and want to save our new user object,
  // .save() will check the user fetched above to our userModel, and finds out that the passwordConfirm
  // field is not there (therefore, in this case, there is an error.) As a result, since we don't want the
  // validator to check the passwordConfirm field, we will disable it using validateBeforeSave: false.
  // await user.save();
  // 3.send it to user email
  // a quick note, we need a / before api, host is 127.0.0.0:3000, which doesn't have a slash
  ///////////////////////////////////////////////////////////////////////////////////////////////////
  /// before section 13
  // const resetURL = `${req.protocol}://${req.get(
  //   'host'
  // )}/api/v1/users/resetPassword/${resetToken}`;
  // const message = `Forgot your password? Submit a patch request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email.`;
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////
  try {
    /////////////////////////////////////////////////////////
    /// before section 13
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Your password reset token (valid for 10 min) ',
    //   message,
    // });
    /////////////////////////////////////////////////////////
    ///// newly changed in section 13
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();
    ///////////////////////////////////////////////////////////
    res.status(200).json({
      status: 'success',
      message: 'Password reset token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
  // next(); // I think we don't need a next call because we are the end controllers of a specific route, if there are two controllers, and we are the first controller, then we need a next() call at the end.
});

const resetPassword = catchAsync(async (req, res, next) => {
  // 1.get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token) // this token variable comes from the params of req (in req path)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2.if token has not expired and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // <----- big important notice ----->
  // we are using .save() here and not .findOneAndUpdate() because the validator can be run only when using (save and create) not findOneAndUpdate
  // Well, Jonas said, that in terms of passwords, we need to use save() or create() to be able to use validators, because validators only works for these 2 methods, and they doesn't work for update. Although, if we were to use findOneAndUpdate, we would use { runValidators: true } option, right?
  await user.save();
  // 3.update passwordChangedAt property for the user
  // 4.log the user in, send JWT
  createSendToken(user, 200, res);
  // const token = signToken(user._id);
  // res.status(200).json({ status: 'success', token });
});

const updatePassword = catchAsync(async (req, res, next) => {
  // 1. get user from collection
  // we need a select("+password") because originally, the password field in userModel was defined as select:false, meaning we cannot see it when query from the database,
  // so we need to explicitly mention select("+password") here, so that we can get the password field from the query
  // This is working as intended. { select : false } means the field will not be queried from the database at all. Thus, you cannot have access to it inside the method unless you specifically override that setting.
  const user = await User.findById(req.user._id).select('+password');
  // 2.check if POSTed password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }
  // 3.if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //4.log user in, send JWT
  createSendToken(user, 200, res);
});

module.exports = {
  signup,
  login,
  protect,
  restrictTo,
  forgotPassword,
  resetPassword,
  updatePassword,
  isLoggedIn,
  logout,
};
// seems like even if there is one function to export, we do need to wrap that into {}.
// module.exports = signup;
