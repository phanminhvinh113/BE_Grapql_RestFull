import express from "express";
const route = express.Router();
//
route.get("/get-all-user", (_req: any, res: any) => {
  res.status(200).json({
    code: 0,
    data: [],
  });
});

//
module.exports = route;
