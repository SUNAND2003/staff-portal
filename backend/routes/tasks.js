const express = require('express');
const router = express.Router();

const {
  protect,
  managerOrAdmin,
} = require('../middleware/auth');

const ctrl = require('../controllers/taskController');

// Protect all routes
router.use(protect);

// GET MY TASKS
router.get('/my', ctrl.getMyTasks);

// GET ALL TASKS
router.get('/all', managerOrAdmin, ctrl.getAllTasks);

// GET SINGLE TASK
router.get('/:id', ctrl.getById);

// CREATE TASK
router.post('/', ctrl.createTask);

// UPDATE TASK
router.patch('/:id', ctrl.updateTask);

// DELETE TASK
router.delete('/:id', managerOrAdmin, ctrl.deleteTask);

module.exports = router;