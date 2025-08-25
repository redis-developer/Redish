import { Router } from 'express';
import CONFIG from '../../../config.js';

const router = Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { app_name: CONFIG.appName  || 'RediBuddy' });
});

router.get('/app', function(req, res, next) {
	res.render('chat', { app_name: CONFIG.appName  || 'RediBuddy', useLangCache: CONFIG.useLangCache });
});


export default router;