const uploaded_files = require('./data/uploaded_files.json')
const shell = require('shelljs')

exports.seed = function(knex) {
  uploaded_files.forEach((file) => {
    shell.cp(`migrations/seeds/files/${file.name}`, `public/uploads/${file.name}`)
  })

  return knex('upload_file').truncate()
    .then(function(){
      return knex('upload_file').insert(uploaded_files)
    })
};
