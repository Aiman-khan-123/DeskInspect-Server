// middleware/validationMiddleware.js

/**
 * Validate rubric data
 */
export const validateRubric = (req, res, next) => {
  const { name, criteria } = req.body;
  const errors = [];

  // Validate rubric name
  if (!name || !name.trim()) {
    errors.push({
      field: 'name',
      message: 'Rubric name is required'
    });
  } else if (name.length > 200) {
    errors.push({
      field: 'name',
      message: 'Rubric name cannot exceed 200 characters'
    });
  }

  // Validate criteria array
  if (!Array.isArray(criteria) || criteria.length === 0) {
    errors.push({
      field: 'criteria',
      message: 'At least one criterion is required'
    });
  } else {
    // Validate each criterion
    criteria.forEach((criterion, index) => {
      if (!criterion.name || !criterion.name.trim()) {
        errors.push({
          field: `criteria[${index}].name`,
          message: `Criterion ${index + 1}: Name is required`
        });
      }

      if (typeof criterion.max_score !== 'number' || criterion.max_score <= 0) {
        errors.push({
          field: `criteria[${index}].max_score`,
          message: `Criterion ${index + 1}: Max score must be a positive number`
        });
      }

      if (criterion.max_score > 100) {
        errors.push({
          field: `criteria[${index}].max_score`,
          message: `Criterion ${index + 1}: Max score cannot exceed 100`
        });
      }

      if (criterion.weight && (criterion.weight < 0.1 || criterion.weight > 5)) {
        errors.push({
          field: `criteria[${index}].weight`,
          message: `Criterion ${index + 1}: Weight must be between 0.1 and 5`
        });
      }

      if (criterion.description && criterion.description.length > 500) {
        errors.push({
          field: `criteria[${index}].description`,
          message: `Criterion ${index + 1}: Description cannot exceed 500 characters`
        });
      }
    });
  }

  // Validate description (optional)
  if (req.body.description && req.body.description.length > 500) {
    errors.push({
      field: 'description',
      message: 'Description cannot exceed 500 characters'
    });
  }

  // Validate is_public (optional)
  if (req.body.is_public !== undefined && typeof req.body.is_public !== 'boolean') {
    errors.push({
      field: 'is_public',
      message: 'is_public must be a boolean'
    });
  }

  // Check for validation errors
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
};

/**
 * Validate rubric duplication
 */
export const validateDuplicateRubric = (req, res, next) => {
  const { name } = req.body;
  const errors = [];

  // Validate new rubric name
  if (!name || !name.trim()) {
    errors.push({
      field: 'name',
      message: 'New rubric name is required'
    });
  } else if (name.length > 200) {
    errors.push({
      field: 'name',
      message: 'Rubric name cannot exceed 200 characters'
    });
  }

  // Check for validation errors
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
};

/**
 * Validate rubric ID parameter
 */
export const validateRubricId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id || !id.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Rubric ID is required'
    });
  }

  // Basic check for MongoDB ObjectId format (24 hex characters)
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (!objectIdRegex.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid rubric ID format'
    });
  }

  next();
};

/**
 * Validate pagination query parameters
 */
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  const errors = [];

  if (page && (isNaN(page) || parseInt(page) < 1)) {
    errors.push({
      field: 'page',
      message: 'Page must be a positive integer'
    });
  }

  if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
    errors.push({
      field: 'limit',
      message: 'Limit must be between 1 and 100'
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
};

/**
 * Validate search query parameters
 */
export const validateSearch = (req, res, next) => {
  const { search, sortBy, order } = req.query;
  const errors = [];

  if (search && typeof search !== 'string') {
    errors.push({
      field: 'search',
      message: 'Search query must be a string'
    });
  }

  const validSortFields = ['name', 'created_at', 'updated_at', 'total_score', 'usage_count'];
  if (sortBy && !validSortFields.includes(sortBy)) {
    errors.push({
      field: 'sortBy',
      message: `Sort field must be one of: ${validSortFields.join(', ')}`
    });
  }

  if (order && !['asc', 'desc'].includes(order.toLowerCase())) {
    errors.push({
      field: 'order',
      message: 'Order must be either "asc" or "desc"'
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
};