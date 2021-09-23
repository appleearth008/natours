// review text/rating/ createdAt/ ref to tour / ref to user
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'A review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A review must belong to a user.'],
    },
  },
  {
    // show any virtual fields that are not saved to databased
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

reviewSchema.index({ tour: 1, user: 1 }, { unique: true });
// since means that for each review, there must be only one tour and one user (tour + user combined) for it

reviewSchema.pre(/^find/, function (next) {
  //   this.populate({ path: 'tour', select: '-guides name' })
  this.populate({
    path: 'user',
    select: 'name photo',
  }); // we want to populate the tour {this is the name in the reviewSchema above}, and want to only show the name
  next();
});

// static methods, on Review, not on each review document (which is called instance method)
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // this should point to the Model, which is Review here
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: null, // weird, why do we have to group by tour if we know we are in the tourId tour,
        /// Jonas use _id: "$tour", but I think null is correct
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5, // with no review, default to 4.5
    });
  }
};

reviewSchema.post('save', async function () {
  /////////////////////////////////////////////////////////////////////////
  // jonas didn't use async/await here, I think we should do this: since calcAverageRatings is an async function, we have to use async/await here.
  ////////////////////////////////////////////////////////////////////////
  // this points to the current review document
  // since calcAverageRatings is a static method of Review,
  // we normally would use Review.calcAverageRatings, but here,
  // we only have access to the current review document (which is an instance of the Review),
  // so we need to use this.constructor
  await this.constructor.calcAverageRatings(this.tour);
  // next(); // the post middleware does not have next as params, and there is no need to call next() at the end
});

//// findByIdAndUpdate
//// findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne(); // execute the query in the pre query middleware, so that we can get the document in the post query middleware
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // cannot do await this.findOne() here, because the query has already been executed, this changes from query in pre middleware to document in post middleware
  await this.r.constructor.calcAverageRatings(this.r.tour);
});
const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
