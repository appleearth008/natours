const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
const User = require('./userModel');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour must have less or equal to 40 characters'],
      minlength: [10, 'A tour must have more or equal to 10 characters'],
      // validate: [validator.isAlpha, 'tour name must only contain characters'],
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      // enum only for strings, not numbers
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'The difficulty must be either easy, medium, or difficult',
      },
    },

    ratingsAverage: {
      type: Number,
      default: 4.5,
      // min and max can work for numbers and Dates
      min: [1, 'A rating must be above 1.0'],
      max: [5, 'A rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // this simply round values to one decimal point
      // set is called before this rating data is stored into the database/ each time there is a value for the rating field
    },
    ratingsQuantity: { type: Number, default: 0 },
    price: { type: Number, required: [true, 'A tour must have a price'] },
    priceDiscount: {
      type: Number,
      // custom validators
      validate: {
        validator: function (val) {
          // caveat: the this keyword only points to the current document when creating a new document, doesn't work on updating documents

          return val < this.price;
        },
        message: 'discount price ({VALUE}) should be below regular price',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summary'],
    },
    description: { type: String, trim: true },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: { type: Date, default: Date.now(), select: false },
    startDates: [Date],
    secretTour: { type: Boolean, default: false },
    startLocation: {
      // GeoData
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    // embedded other documents (which is mongo id field in it) using an array
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    // guides: Array, //// for embedding
    /// but we will implement guides using child referencing
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// indexes/ sort the field values
// tourSchema.index({ price: 1 }); // single field indexes
tourSchema.index({ price: 1, ratingsAverage: -1 }); // compound indexes
tourSchema.index({ slug: 1 });
// for geospatial query, we need this special index
tourSchema.index({ startLocation: '2dsphere' });

// virtual properties, not stored in database because
// it can be easily calculated from the current values
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // because we need to use this keyword,
  //we need to use regular functions, not arrow functions (arrow functions dont have this keyword)
});

// virtual populate, do child referencing, but don't save data on database, so it is virtual
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

/// document middleware, runs before .save() and .create()
// this middleware can also be called a pre save hook.
tourSchema.pre('save', function (next) {
  // in the document middleware, this keyword points to the current document
  this.slug = slugify(this.name, { lower: true });
  next();
});
// another pre document middleware
// tourSchema.pre('save', (next) => {
//   console.log('Will save document...');
//   next();
// });
// the post document middleware
// tourSchema.post('save', (docs, next) => {
//   console.log(doc); // we don't have access to the this keyword above in the pre document middleware, because documnets are saved into database, now we have the saved version of this, which is doc instead.
//   next();
// });

//// create new guides in tour (using embedding), not for updating.
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

//// query middleware:
///// use /^find/ here because, we want this middleware to run on find, findOne, findOneAndDelete, etc.
tourSchema.pre(/^find/, function (next) {
  // since this is the query middleware, the this keyword points to the query, thus we can chain another query method find()
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});

/// populate query middleware
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v', // this select will not show query fields only in the populated fields, will only not showing __v field of guides, not tours
  });
  next();
});

///////////////////////////////////////////////////////
/// turned off in section 14
// tourSchema.post(/^find/, function (docs, next) {
//   console.log(`The query took ${Date.now() - this.start} milliseconds!`);
//   next();
// });
//////////////////////////////////////////////////

///// aggregation middleware
///// "$geoNear is only valid as the first stage in a pipeline."
//// since this middleware function is before the running is $geoNear,
//// we want to omit it for now.
// tourSchema.pre('aggregate', function (next) {
//   // unshift will add some an object to the beginning of an array
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
//   next();
// });
const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
