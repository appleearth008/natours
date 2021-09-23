// const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// single and array of files use => .fields
const uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// upload.single('image') req.file  //// single file
// upload.array('images', 5) req.files //// array of files

const resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();

  // 1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );

  next();
});

const aliasTopTours = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};
// JSON.parse will parse json object into JavaScript object
// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`)
// );

////// in mongoDB, we don't need to check ID
// const checkID = (req, res, next, val) => {
//   console.log(`Tour id is ${val}`);
//   // check for invalid id number
//   if (req.params.id * 1 > tours.length) {
//     return res.status(404).json({ status: 'fail', message: 'Invalid ID' });
//   }
//   next();
// };

///// mongoose will handle this!
// const checkBody = (req, res, next) => {
//   if (!req.body.name || !req.body.price) {
//     // don't forget to return, otherwise, the req will go through this
//     // middleware via the next() function call, which is not logical.
//     return res
//       .status(400)
//       .json({ status: 'fail', message: 'missing name or price' });
//   }
//   next();
// };

//// 2) route handlers
const getAllTours = factory.getAll(Tour);
// const getAllTours = catchAsync(async (req, res, next) => {
//// build the query
// const queryObj = { ...req.query };
// const excludedFields = ['page', 'sort', 'limit', 'fields'];
// excludedFields.forEach((el) => delete queryObj[el]);
// // console.log(queryObj, req.query);
// /// 1B) advanced filtering
// let queryStr = JSON.stringify(queryObj);
// queryStr = queryStr.replace(/\b(lt|lte|gt|gte)\b/g, (match) => `$${match}`);

// let query = Tour.find(JSON.parse(queryStr));

//// 2) sorting:
// console.log(req.query.sort);
// if (req.query.sort) {
//   const sortBy = req.query.sort.split(',').join(' ');
//   query = query.sort(sortBy);
// } else {
//   // default sorting
//   query = query.sort('-createdAt');
// }

//// 3) limiting fields / projections
// if (req.query.fields) {
//   const fields = req.query.fields.split(',').join(' ');
//   query = query.select(fields);
// } else {
//   query = query.select('-__v');
// }
/// 4) pagination
// const page = req.query.page * 1 || 1;
// const limit = req.query.limit * 1 || 100;
// const skip = (page - 1) * limit;
// query = query.skip(skip).limit(limit);
// ///// handling invalid pages
// if (req.query.page) {
//   const numTours = await Tour.countDocuments();
//   if (skip >= numTours) throw new Error('This page does not exist!');
// }
/// execute the query
//   const features = new APIfeatures(Tour.find(), req.query)
//     .filter()
//     .sort()
//     .limitFields()
//     .paginate();
//   const tours = await features.query;

//   /// send response
//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: { tours },
//   });
// });

const getTour = factory.getOne(Tour, { path: 'reviews' });
// const getTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findById(req.params.id).populate('reviews');
//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }
//   res.status(200).json({
//     status: 'success',
//     data: { tour },
//     // results: tours.length, data: { tours }
//   });
//   //   console.log(req.params);
//   // const id = req.params.id * 1;
//   // const tour = tours.find((el) => el.id === id);
// });

const createTour = factory.createOne(Tour);
// const createTour = catchAsync(async (req, res, next) => {
//   const newTour = await Tour.create(req.body);
//   res.status(201).json({
//     status: 'success',
//     data: { newTour },
//   });
// });

const updateTour = factory.updateOne(Tour);
// const updateTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//     runValidators: true,
//   });
//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }
//   res.status(200).json({ status: 'success', data: { tour } });
// });

const deleteTour = factory.deleteOne(Tour);
// const deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);
//   if (!tour) {
//     return next(new AppError('No tour found with that ID', 404));
//   }
//   res.status(204).json({ status: 'success', data: { tour: null } });
// });

const getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    { $match: { ratingsAverage: { $gte: 4.5 } } },
    {
      $group: {
        // first is group by; {_id: null} means only one group
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        maxPrice: { $max: '$price' },
        minPrice: { $min: '$price' },
      },
    }, // can only use the name specified in the group above
    { $sort: { avgPrice: 1 } },
    // { $match: { _id: { $ne: 'EASY' } } },
  ]);
  res.status(200).json({ status: 'success', data: { stats } });
});

const getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;
  const plan = await Tour.aggregate([
    { $unwind: '$startDates' },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' },
      },
    },
    { $addFields: { month: '$_id' } },
    { $project: { _id: 0 } },
    { $sort: { numTourStarts: -1 } }, // -1 for descending, 1 for ascending
    { $limit: 12 },
  ]);
  res.status(200).json({ status: 'success', data: { plan } });
});

// ('/tours-within/:distance/center/:latlng/unit/:unit');
// tours-within/233/center/37.878228,-122.262432/unit/mi
const getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params; // destructing has to use the same name on the left.
  const [lat, lng] = latlng.split(','); // destructing objects using {}, but destructing arrays using [] {I am not sure, check this later}
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lgn.',
        400
      )
    );
  }
  // console.log(radius, lat, lng, distance, latlng, unit);
  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });
  res
    .status(200)
    .json({ status: 'success', results: tours.length, data: { data: tours } });
  // next();
});

const getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params; // destructing has to use the same name on the left.
  const [lat, lng] = latlng.split(','); // destructing objects using {}, but destructing arrays using [] {I am not sure, check this later}
  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;
  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lgn.',
        400
      )
    );
  }
  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng * 1, lat * 1] }, // distance of each tour near lat and lng we specified in req.params
        distanceField: 'distance', // will simply create a new field called distance and fill in the calculated distance from lat and lng
        distanceMultiplier: multiplier,
      },
    },
    { $project: { distance: 1, name: 1 } }, // this distance name is coming from distanceField: 'distance' above
  ]); // this is called the aggregation pipeline, always called on the Model (Tour) itself
  res.status(200).json({ status: 'success', data: { data: distances } });
  // next();
});

module.exports = {
  getAllTours,
  getTour,
  createTour,
  updateTour,
  deleteTour,
  // checkID,
  // checkBody,
  aliasTopTours,
  getTourStats,
  getMonthlyPlan,
  getToursWithin,
  getDistances,
  uploadTourImages,
  resizeTourImages,
};
