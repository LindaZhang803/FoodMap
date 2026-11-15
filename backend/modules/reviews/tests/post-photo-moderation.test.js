const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createModels } = require('../models');
const { ReviewPhoto } = createModels(mongoose);
const service = require('../../posts/services/postService');
const controller = require('../../posts/controllers/postController');
const Post = mongoose.models.Post;
const PostPhoto = mongoose.models.PostPhoto;

const photoId = '300000000000000000000001';
const sourceId = '300000000000000000000002';
const postId = '200000000000000000000001';
const reviewId = '100000000000000000000001';
const data = Buffer.from('synthetic copied photo');
const query = value => ({
  select() { return this; },
  lean: async () => value
});

test('published photo follows source approval and responses disable caching', async t => {
  assert.ok(PostPhoto.schema.path('sourceReviewPhotoId'));
  let status = 'approved';
  t.mock.method(PostPhoto, 'findById', () => query({
    _id: photoId, postId, sourceReviewPhotoId: sourceId, data
  }));
  t.mock.method(Post, 'findOne', filter => {
    assert.equal(filter.status, 'published');
    assert.equal(filter.imageUrls, `/api/posts/photos/${photoId}`);
    return query({ _id: postId, reviewId });
  });
  t.mock.method(ReviewPhoto, 'findOne', filter => {
    assert.equal(String(filter._id), sourceId);
    assert.equal(String(filter.reviewId), reviewId);
    assert.equal(filter.status, 'approved');
    return query(status === 'approved' ? { _id: sourceId } : null);
  });

  assert.deepEqual((await service.getPostPhoto(photoId)).data, data);
  for (const value of ['rejected', 'pending', 'deleted']) {
    status = value;
    await assert.rejects(service.getPostPhoto(photoId), error => error.status === 404);
  }

  status = 'approved';
  assert.deepEqual((await service.getPostPhoto(photoId)).data, data);

  const headers = {};
  let body;
  const res = {
    setHeader(name, value) { headers[name] = value; },
    send(value) { body = value; return this; }
  };
  await controller.getPostPhoto({ params: { photoId } }, res);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.deepEqual(body, data);
});

test('legacy post photos require matching approved original image bytes', async t => {
  let originals = [{ _id: sourceId, data }];
  t.mock.method(PostPhoto, 'findById', () => query({ _id: photoId, postId, data }));
  t.mock.method(Post, 'findOne', () => query({ _id: postId, reviewId }));
  t.mock.method(ReviewPhoto, 'find', filter => {
    assert.equal(filter.reviewId, reviewId);
    assert.equal(filter.status, 'approved');
    return query(originals);
  });

  assert.deepEqual((await service.getPostPhoto(photoId)).data, data);
  originals = [{ _id: sourceId, data: Buffer.from('different image') }];
  await assert.rejects(service.getPostPhoto(photoId), error => error.status === 404);
  originals = [];
  await assert.rejects(service.getPostPhoto(photoId), error => error.status === 404);
});
