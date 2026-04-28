import app from '../../../backend/src/index';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default app;
