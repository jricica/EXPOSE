import { UserContext } from './auth-context';

declare global {
	namespace Express {
		interface Request {
			user?: any;
			context?: UserContext;
		}
	}
}


export { };
