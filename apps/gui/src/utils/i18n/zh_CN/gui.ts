import { brandConfig } from '@studio/utils';

export default {
  loginModal: {
    title: `连接 ${brandConfig.nameZhCN} 图数据库`,
    desc: '请输入账号密码',
    username: '账号',
    password: '密码',
    connect: '连接',
    loginFailed: '登录失败, 账号或密码错误',
    passwordRequired: '密码不能为空',
    usernameRequired: '账号不能为空',
  },
  header: {
    notConnected: '未连接',
    clearConnect: '清除连接',
  },
};
