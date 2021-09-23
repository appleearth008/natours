/* eslint-disable */
// this import axios from 'axios'; is called the ES6 module syntax, which is different from the const express = require('express') syntax (commonJS module syntax)
import axios from 'axios';
import { showAlert } from './alerts';

export const login = async (email, password) => {
  //   console.log(email, password);
  try {
    const res = await axios({
      method: 'POST',
      url: 'http://127.0.0.1:3000/api/v1/users/login',
      data: { email, password },
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully!');
      window.setTimeout(() => {
        location.assign('/');
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: 'http://127.0.0.1:3000/api/v1/users/logout',
    });
    // console.log(res);
    if (res.data.status === 'success') {
      // the true in reload function will load from the server, not from browser cache (which might have our user menu out there {might still show the login page})
      // window.location.href = window.location.href;
      // setTimeout(function () {
      //   window.location.reload();
      // }, 100);
      ////// have problems here
      // res.clearCookie('jwt');
      // window.location.reload();
      location.assign('/');
    }
  } catch (err) {
    console.log(err);
    showAlert('error', 'Error logging out. Try again!');
  }
};
