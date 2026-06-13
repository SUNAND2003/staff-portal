const Task = require('../models/Task');
const User = require('../models/User');


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
      priority,
      dueDate,
      tags,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: 'Title is required',
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

    const task = await Task.create({
      title,
      description: description || '',
      assignedTo: finalAssignedTo,
      assignedBy: req.user._id,
      priority: (priority || 'medium').toLowerCase(),
      dueDate,
      tags: tags || [],
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
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority.toLowerCase();
    if (progress !== undefined) task.progress = progress;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (tags !== undefined) task.tags = tags;

    if (assignedTo && isAdminOrManager) {
      task.assignedTo = assignedTo;
    }

    if (status === 'completed') {
      task.completedAt = new Date();
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name employeeId department avatar')
      .populate('assignedBy', 'name employeeId avatar');

    res.json(updatedTask);
  } catch (err) {
    console.error(err);
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