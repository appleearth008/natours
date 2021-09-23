const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// name, email, photo, password, passwordConfirm
const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Please tell us your name'] },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: { type: String, default: 'default.jpg' },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    /// this is a required input, but doesnt mean to be persistent to the database,
    // can be deleted later using this.passwordConfirm = undefined
    required: [true, 'Please confirm your password.'],
    // required: true,
    validate: {
      validator: function (el) {
        // because we need to use the this keyword here, so we need to use function expressions, not arrow functions
        // in addition, this validator will only be functional if we use CREATE {User.CREATE; mongoose function} (create a new user)
        // and SAVE {USER.SAVE; mongoose function} (update user's info)
        return el === this.password;
      },
      message: 'Passwords are not the same',
    },
  },
  passwordChangedAt: { type: Date },
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: { type: Boolean, default: true, select: false }, // if we set select to be false, we will not get this field if we query from the database
});

/// document pre save hook/ middleware
userSchema.pre('save', async function (next) {
  // only run this function if the password is actually modified
  if (!this.isModified('password')) {
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12); // cost of 12
  this.passwordConfirm = undefined; // delete the passwordConfirm field
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // to ensure that JWT is created after this changedPassword timestamp.
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the current query because this is a query middleware
  this.find({ active: { $ne: false } });
  next();
});

// instance method of userSchema/ avaialbe on all user document (on all instances of users/on each user):
userSchema.methods.correctPassword = async function (
  originalPassword,
  hashedPassword
) {
  return await bcrypt.compare(originalPassword, hashedPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  // false means not changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 mins from now
  return resetToken;
};
// I think this User is called a Model prototype, but when you do
// something like user1 = User(), then user1 is an actual model instance.
// not sure if this is corrert now
const User = mongoose.model('User', userSchema);

module.exports = User;
