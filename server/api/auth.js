const router = require('express').Router();
const db = require('../model');
const md5 = require('js-md5');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const redis = require('../utils/redis');

//内置管理员账号
const ADMIN_ACCOUNT = config.auth.adminAccount;
const ADMIN_PWD = config.auth.adminPwd;
const ADMIN_ID = config.auth.adminId;
const ADMIN_NAME = config.auth.adminName;

/**
 * 是否是管理员
 * @param model
 * @returns {boolean}
 */
const isAdmin = (model) => {
  return ADMIN_ACCOUNT == model.account && md5(ADMIN_PWD) == model.password;
};

/**
 * 保存token
 * @param id
 * @param expireTime
 * @returns {*}
 */
const saveToken = async(id, expireTime) => {
  //获取用户的权限
  const userAuth = await getUserAuth(id);
  if (userAuth) {
    //缓存到redis中
    redis.set(`auth-${userAuth.id}`, JSON.stringify(userAuth), 'EX', 60 * 60 * 24 * 7);
  }
  const token = jwt.sign({
    user: { id },
    expireTime: expireTime || Date.now() + 1000 * 60 * 60 * 24 * 7
  }, config.secret);
  redis.set(id, token, 'EX', 60 * 60 * 24 * 7);
  return token;
};

/**
 * 获取token
 * @param req
 */
const getToken = (req) => req.cookies.token || req.headers['x-auth-token'];

/**
 * 验证token
 * @param token
 * @returns {Promise.<boolean>}
 */
const checkToken = async(token) => {
  if (token) {
    //解析token
    const decoded = jwt.verify(token, config.secret);
    const user = decoded.user;
    const expireTime = decoded.expireTime;
    if (user && user.id) {
      const userId = user.id;
      // 验证token是否过期
      if (Date.now() >= expireTime) {
        // 删除 token
        await redis.del(userId);
      } else {
        const result = await redis.get(userId);
        if (result === token) {
          return true;
        }
      }
    }
  }
  return false
};

/**
 * 获取用户权限相关信息
 * @param userId
 */
const getUserAuth = async(userId) => {

  const rights = (await db.Rights.findAll()).map(n => n.toJSON());
  //如果是管理员登录,获取全部权限
  if (userId === ADMIN_ID) {
    const menus = (await db.Menu.findAll()).map(n => n.toJSON());
    return {
      id: ADMIN_ID,
      name: ADMIN_NAME,
      account: ADMIN_ACCOUNT,
      mobile: '00000000000',
      menus: menus,
      rights: rights.map(n => Object.assign(n, { hasRights: true }))
    }
  } else {
    //查找用户
    const user = await db.User.findById(userId, { include: [{ model: db.Role, include: [db.Menu, db.Rights] }] });
    //用户拥有的菜单
    let userMenus = [], userRights = [];
    if (user.toJSON()) {
      const roles = user.roles;
      if (roles && roles.length > 0) {
        roles.forEach(n => {
          const roleMenus = n.menus;
          const roleRights = n.rights;
          if (roleMenus && roleMenus.length > 0) {
            roleMenus.forEach(m => {
              //过滤重复的菜单
              if (!userMenus.some(p => p.code === m.code)) {
                userMenus.push(m);
              }
            })
          }
          if (roleRights && roleRights.length > 0) {
            userRights = rights.map(n => {
              if (roleRights.some(p => p.id === n.id)) {
                return { ...n, hasRights: true }
              } else {
                return { ...n, hasRights: false }
              }
            })
          } else {
            userRights = rights.map(n => Object.assign(n, { hasRights: true }));
          }
        })
      }
      return {
        id: user.id,
        name: user.name,
        account: user.account,
        mobile: user.mobile,
        menus: userMenus,
        rights: userRights
      };
    }
  }
  return null;
};
/**
 * 登录
 */
router.post('/login', async(req, res, next) => {
    let expireTime;
    const model = req.body;
    if (req.isEmpty(model)) return res.error('账户名或密码不能为空！');
    //过期时间
    expireTime = Date.now() + 1000 * 60 * 60 * 24 * 7;
    //如果是超级管理员登录
    if (isAdmin(model)) {
      let token = await saveToken(ADMIN_ID);
      //设置cookie
      res.cookie('token', token, { expires: new Date(expireTime), httpOnly: true });
      return res.success({ name: ADMIN_NAME });
    }
    try {
      //查找用户
      const user = await db.User.findOne({ where: { account: model.account } });

      if (user && user.password === model.password) {
        //保存token
        const token = await saveToken(user.id);
        //设置cookie
        res.cookie('token', token, { expires: new Date(expireTime), httpOnly: true });
        //返回token
        return res.success(user);
      }
    } catch (error) {
      return res.error(error.message);
    }
    return res.error('账户名或密码错误!');
  }
);


/**
 * 验证token有效性
 */
router.post('/checkToken', async(req, res, next) => {
  // 获取token
  const token = getToken(req);
  const isValidate = await checkToken(token);
  if (isValidate) {
    return res.success(true);
  } else {
    res.clearCookie('token');
    return res.success(false);
  }
});


/**
 * 登出
 */
router.post('/logout', async(req, res) => {
  // 获取token
  const token = getToken(req);
  if (token) {
    const decoded = jwt.verify(token, config.secret);
    if (decoded) {
      const { id } = decoded.user;
      // 验证token是否存在
      const result = await redis.get(id);
      if (result === token) {
        redis.del(id);
        res.clearCookie('token');
        return res.success('', '成功登出!');
      }
    }
  }
  res.error('权限已经失效!');
});

/**
 * 获取对应的权限菜单
 */
router.get('/user', async(req, res) => {
  // 获取token
  const token = getToken(req);
  if (token) {
    const decoded = jwt.verify(token, config.secret);
    const user = decoded.user;
    const userId = user.id;

    //获取用户的权限
    const userAuth = await getUserAuth(userId);
    if (userAuth) {
      //缓存到redis中
      redis.set(`auth-${userAuth.id}`, JSON.stringify(userAuth), 'EX', 60 * 60 * 24 * 7);
      return res.success(userAuth);
    }
  }

  return res.error('获取用户信息失败!')
});


router.post('/pwd', async function (req, res) {
  try {
    if (req.isEmpty(req.body) || req.isEmpty(req.user)) return res.error('修改用户密码失败，缺少参数');
    // 根据登录信息，获取用户ID
    let pwd = req.body.oldPassword;
    let newPwd = req.body.password;
    // 修改密码
    const user = await db.User.findOne({ where: { id: req.user.id, password: pwd } });
    if (user) {
      user.password = newPwd;
      user.save();
      res.success(user, '修改密码成功!');
    } else {
      res.error("旧密码输入错误!")
    }
  }
  catch (error) {
    res.error(error.message);
  }

})

module.exports = router;
