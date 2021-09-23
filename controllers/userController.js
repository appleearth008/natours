const multer = require('multer');
const sharp = require('sharp');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/userModel');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },
//   filename: (req, file, cb) => {
//     // file here is actually req.file
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });
const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});
//// ? does this 'photo' name inside upload.single('photo') has to match exactly the field name
// in our userModel? I think yes, because we also want to upload the file to the database
const uploadUserPhoto = upload.single('photo');
// resize user uploaded photo middleware
const resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    // write the file into our filesystem
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

const getAllUsers = factory.getAll(User);
// const getAllUsers = catchAsync(async (req, res, next) => {
//   const users = await User.find();
//   res
//     .status(200)
//     .json({ status: 'success', results: users.length, data: { users } });
// });

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

const getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

const updateMe = catchAsync(async (req, res, next) => {
  // 1. create error if user tries to update password
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password update. Please use /updateMyPassword',
        400
      )
    );
  }
  ///////////////////////////////////////////////////////////////
  // the reason why this is incorrect, is that .save() will automatically
  // check all validators on all fields in our model (most importantly, the changed one, not all field, but the fields that have
  // been changed when we pull out from our database, using User.findById/findOne, etc. In the below example, email is changed, so the .save() will
  // call the validator on email and send us a {Please provide a valid email} message. In addition, since we set our passwordConfirm field to undefined in
  // our middleware, this field is also changed, so .save() will call the validator on passwordConfirm field of our model also, and thus a {Please confirm your password}
  // error message would send back). If we, as we did in authController, set validateBeforeSave: false, then no validator will run. Now, neither passwordConfirm nor email will
  // trigger an error. So we don't want to use .save() and set validateBeforeSave to false here. Therefore, we need to use findByIdAndUpdate, which won't automatically
  // call any validators. if we want to validate those fields in the req.body, we need to set runValidators: true in the findByIdAndUpdate function below.
  //
  // const user = await User.findById(req.user.id);
  // user.email = 'appe123';
  // await user.save({ validateBeforeSave: false });
  //////////////////////////////////////////////////////////
  // 2. filtered out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  // for uploading photo file name to the database
  if (req.file) filteredBody.photo = req.file.filename;
  // 3. update other user documents
  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true, // (this validator will only validate the fields in req.body)
  });
  res.status(200).json({ status: 'success', data: { user: updatedUser } });
});

//  this is for a user to delete himself, but this will not delete all data in the database,
// only set active to false; see below deleteUser() for admin to completely delete user from the database
const deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({ status: 'success', data: null });
});

const createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined. Please use /signup instead.',
  });
};

const getUser = factory.getOne(User);
// const getUser = (req, res) => {
//   res
//     .status(500)
//     .json({ status: 'error', message: 'This route is not yet defined' });
// };

// Do not update passwords with this!
const updateUser = factory.updateOne(User);
// const updateUser = (req, res) => {
//   res
//     .status(500)
//     .json({ status: 'error', message: 'This route is not yet defined' });
// };

// this is for admin to delete user, completely delete user from the database
const deleteUser = factory.deleteOne(User);
// const deleteUser = (req, res) => {
//   res
//     .status(500)
//     .json({ status: 'error', message: 'This route is not yet defined' });
// };

module.exports = {
  getAllUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  updateMe,
  deleteMe,
  getMe,
  uploadUserPhoto,
  resizeUserPhoto,
};
