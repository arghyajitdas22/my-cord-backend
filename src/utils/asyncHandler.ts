import { NextFunction, Request, Response } from "express";

const asynHandler = (requestHandler: Function) => {
  return (request: Request, response: Response, next: NextFunction) => {
    Promise.resolve(requestHandler(request, response, next)).catch(
      (err: Error) => next(err)
    );
  };
};

export { asynHandler };
