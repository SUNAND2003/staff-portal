const Task = require('../models/Task');
const User = require('../models/User');
const mongoose = require('mongoose');

const normalizeTaskStatus = (s) => {
  if (!s) return undefined;
  const clean = String(s).toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (clean === 'inprogress' || clean === 'in_progress') return 'in_progress';
  if (clean === 'onhold' || clean === 'on_hold' || clean === 'hold') return 'on_hold';
  if (clean === 'completed' || clean === 'done') return 'completed';
  if (clean === 'pending') return 'pending';
  return clean;
};


// GET MY TASKS
exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      assignedTo: req.user._id,
    })
      .populate('assignedTo', 'name employeeId department avatar')
      .populate('assignedBy', 'name employeeId avatar')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error',
    });
  }
};


// CREATE TASK
exports.createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      status,
      priority,
      dueDate,
      tags,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: 'Title is required',
      });
    }

    // Mongoose would throw a CastError (HTTP 500) on a malformed id.
    if (assignedTo && !mongoose.isValidObjectId(assignedTo)) {
      return res.status(400).json({
        message: 'assignedTo must be a valid user id.',
      });
    }

    const finalAssignedTo =
      req.user.role === 'employee'
        ? req.user._id
        : assignedTo || req.user._id;

    const user = await User.findById(finalAssignedTo);

    if (!user) {
      return res.status(404).json({
        message: 'Assigned user not found',
      });
    }

    const initialStatus = normalizeTaskStatus(status) || 'pending';

    const task = await Task.create({
      title,
      description: description || '',
      assignedTo: finalAssignedTo,
      assignedBy: req.user._id,
      status: initialStatus,
      priority: (priority || 'medium').toLowerCase(),
      dueDate,
      tags: tags || [],
      completedAt: initialStatus === 'completed' ? new Date() : null,
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name employeeId department avatar')
      .populate('assignedBy', 'name employeeId avatar');

    res.status(201).json(populatedTask);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error',
    });
  }
};


// UPDATE TASK
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    const isAdminOrManager =
      req.user.role === 'admin' ||
      req.user.role === 'manager';

    if (!isAdminOrManager) {
      const isAssigned =
        task.assignedTo.toString() ===
        req.user._id.toString();

      if (!isAssigned) {
        return res.status(403).json({
          message: 'Not authorized',
        });
      }
    }

    const {
      title,
      description,
      status,
      priority,
      progress,
      dueDate,
      tags,
      assignedTo,
    } = req.body;

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) {
      const normalizedStatus = normalizeTaskStatus(status);
      task.status = normalizedStatus;
      if (normalizedStatus === 'completed') {
        task.completedAt = task.completedAt || new Date();
        if (task.progress === undefined || task.progress === 0) task.progress = 100;
      } else {
        task.completedAt = null;
      }
    }
    if (priority !== undefined) task.priority = priority.toLowerCase();
    if (progress !== undefined) task.progress = progress;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (tags !== undefined) task.tags = tags;

    if (assignedTo && isAdminOrManager) {
      if (!mongoose.isValidObjectId(assignedTo)) {
        return res.status(400).json({ message: 'assignedTo must be a valid user id.' });
      }
      task.assignedTo = assignedTo;
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name employeeId department avatar')
      .populate('assignedBy', 'name employeeId avatar');

    res.json(updatedTask);
  } catch (err) {
    console.error(err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({
      message: 'Server error',
    });
  }
};


// GET SINGLE TASK
exports.getById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name employeeId department avatar')
      .populate('assignedBy', 'name employeeId avatar');

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error',
    });
  }
};


// GET ALL TASKS
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'name employeeId department avatar')
      .populate('assignedBy', 'name employeeId avatar')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error',
    });
  }
};


// DELETE TASK
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({
        message: 'Task not found',
      });
    }

    res.json({
      message: 'Task deleted successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error',
    });
  }
};