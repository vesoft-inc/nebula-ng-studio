import { brandConfig } from '@studio/utils';

export default {
  loginModal: {
    title: `Connect to ${brandConfig.name}`,
    desc: 'Please enter the account password',
    username: 'Username',
    password: 'Password',
    connect: 'Connect',
    loginFailed: 'Login failed, please check your username and password',
    passwordRequired: 'Password is Required',
    usernameRequired: 'Username is Required',
  },
  header: {
    notConnected: 'Not Connected',
    clearConnect: 'Clear Connect',
  },
};
