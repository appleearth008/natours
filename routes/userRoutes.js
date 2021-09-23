const express = require('express');

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

//// 2) route handlers

const router = express.Router();
router.post('/signup', authController.signup);
//// we don't need the following form, becasue there is no other HTTP method other than post in this signup case.
// router.route('/signup').post(authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

////// middleware runs in sequence, the router defined on line 7 is a middleware.
// after the above four functions, we want all the following functions to have a authController.protect middleware
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
// 'photo' is the name of the field that is going to hold the file
// upload.single, single means one single file to upload
router.patch(
  '/updateMe',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userController.updateMe
);
router.delete('/deleteMe', userController.deleteMe);
router.get('/me', userController.getMe, userController.getUser);

router.use(authController.restrictTo('admin'));
router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
