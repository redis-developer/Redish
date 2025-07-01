import { Router } from 'express';

const router = Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('index', { title: 'RediBuddy' });
});

router.get('/app', function(req, res, next) {
	res.render('chat', { title: 'RediBuddy' });
});


export default router;