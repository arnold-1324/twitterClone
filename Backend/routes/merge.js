const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/merge', upload.fields([{ name: 'image' }, { name: 'audio' }]), (req, res) => {
  const image = req.files.image[0];
  const audio = req.files.audio[0];
  const duration = req.body.duration;
  const outputPath = path.join(__dirname, '..', 'uploads', 'output.mp4');

  ffmpeg()
    .input(image.path)
    .input(audio.path)
    .duration(duration)
    .outputOptions('-vf', 'scale=640:480')
    .save(outputPath)
    .on('end', () => {
      res.json({ videoUrl: `/uploads/output.mp4` });
      fs.unlinkSync(image.path);
      fs.unlinkSync(audio.path);
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).send('Error merging files');
    });
});

module.exports = router;
