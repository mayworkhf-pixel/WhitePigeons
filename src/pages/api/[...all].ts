import { NextApiRequest, NextApiResponse } from 'next';
import app from '../../../backend/app';

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false, // Let Express middleware handle body parsing (e.g. express.json)
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return app(req, res);
}
