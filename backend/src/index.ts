import dotenv from 'dotenv';
dotenv.config();

import app from './server';
import { startExpirePostsJob } from './jobs/expirePostsJob';


app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
    // Start background job to mark expired posts
    startExpirePostsJob();
});
