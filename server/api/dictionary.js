/**
 * Created by Adam on 2016-12-6.
 */
const router = require('express').Router();
const db = require('../model');
const _ = require('lodash');

/**
 * 查询
 */
router.post('/query', async(req, res) => {
  try {
    const queryFilter = req.queryFilter(req.body);
    const result = await db.Dictionary.findAndCountAll(queryFilter);
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

/**
 * 新增
 */
router.post('/', async(req, res) => {
  try {
    const model = req.body;
    if (req.isEmpty(model)) return res.error('缺少参数');
    const result = await db.Dictionary.create(model);
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

/**
 * 修改
 */
router.put('/', async(req, res) => {
  try {
    const model = req.body;
    if (req.isEmpty(model)) return res.error('缺少参数');
    const result = await db.Dictionary.update(model, { where: { id: model.id } });
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

/**
 * 删除
 */
router.delete('/:id', async(req, res) => {
  try {
    const id = req.params.id;
    if (req.isEmpty(id)) return res.error('参数不能为空');
    const result = await db.Dictionary.destroy({ where: { id: id } });
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

/**
 * 子表新增
 */
router.post('/mx', async(req, res) => {
  try {
    const model = req.body;
    if (req.isEmpty(model)) return res.error('缺少参数');
    const result = await db.DictionaryMx.create(model);
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

router.put('/mx', async(req, res) => {
  try {
    const model = req.body;
    if (req.isEmpty(model)) return res.error('缺少参数');
    const result = await db.DictionaryMx.update(model, { where: { id: model.id } });
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

/**
 * 子表删除
 */
router.delete('/mx/:id', async(req, res) => {
  try {
    const id = req.params.id;
    if (req.isEmpty(id)) return res.error('参数不能为空');
    const result = await db.DictionaryMx.destroy({ where: { id: id } });
    return res.success(result);
  } catch (error) {
    return res.error(error.message);
  }
});

/**
 * 子表查询
 */
router.get('/:id/mx', async(req, res) => {
  try {
    const id = req.params.id;
    if (req.isEmpty(id)) return res.error('参数不能为空');
    const result = await db.DictionaryMx.findAndCountAll({ where: { dictionaryId: id } });
    return res.success(result);
  } catch (error) {
    res.error(error.message);
  }
});


router.post('/exist', async(req, res) => {
  try {
    let model = req.body;
    if (!req.isEmpty(model.id)) {
      model.id = { '$ne': model.id }
    }
    const result = await db.Dictionary.findOne({ where: model });
    return res.success(result !== null);
  } catch (error) {
    return res.error(error.message);
  }
});

router.post('/mx/exist', async(req, res) => {
  try {
    let model = req.body;
    if (!req.isEmpty(model.id)) {
      model.id = { '$ne': model.id }
    }
    const result = await db.DictionaryMx.findOne({ where: model });
    return res.success(result !== null);
  } catch
    (error) {
    return res.error(error.message);
  }
});

module.exports = router;
