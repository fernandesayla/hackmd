'use strict'

const Router = require('express').Router
const passport = require('passport')
const validator = require('validator')
const LocalStrategy = require('passport-local').Strategy
const config = require('../../../config')
const models = require('../../../models')
const logger = require('../../../logger')
const {setReturnToFromReferer} = require('../utils')
const {urlencodedParser} = require('../../utils')
const response = require('../../../response')

let emailAuth = module.exports = Router()

passport.use(new LocalStrategy({
  usernameField: 'email'
}, function (email, password, done) {
  if (!validator.isEmail(email)) return done(null, false)
  models.User.findOne({
    where: {
      email: email
    }
  }).then(function (user) {
    if (!user) return done(null, false)
    if (!user.verifyPassword(password)) return done(null, false)
    return done(null, user)
  }).catch(function (err) {
    logger.error(err)
    return done(err)
  })
}))

if (config.allowemailregister) {
  emailAuth.post('/register', urlencodedParser, function (req, res, next) {
    if (!req.body.email || !req.body.password) return response.errorBadRequest(res)
    if (!validator.isEmail(req.body.email)) return response.errorBadRequest(res)
    models.User.findOrCreate({
      where: {
        email: req.body.email
      },
      defaults: {
        password: req.body.password
      }
    }).spread(function (user, created) {
      if (user) {
        if (created) {
          logger.debug('user registered: ' + user.id)
          req.flash('info', "You've successfully registered, please signin.")
        } else {
          logger.debug('user found: ' + user.id)
          req.flash('error', 'This email has been used, please try another one.')
        }
        return res.redirect(config.serverurl + '/')
      }
      req.flash('error', 'Failed to register your account, please try again.')
      return res.redirect(config.serverurl + '/')
    }).catch(function (err) {
      logger.error('auth callback failed: ' + err)
      return response.errorInternalError(res)
    })
  })
}

emailAuth.post('/login', urlencodedParser, function (req, res, next) {
  if (!req.body.email || !req.body.password) return response.errorBadRequest(res)
  if (!validator.isEmail(req.body.email)) return response.errorBadRequest(res)
  setReturnToFromReferer(req)
  passport.authenticate('local', {
    successReturnToOrRedirect: config.serverurl + '/',
    failureRedirect: config.serverurl + '/',
    failureFlash: 'Invalid email or password.'
  })(req, res, next)
})
