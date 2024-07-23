const asyncHandler = (reqHandler) => {
    return async (req, res, next) => {
    Promise.resolve(reqHandler(req,res,next)).
    catch((err)=> next(err))
    }
}





export {asyncHandler}

// example 
// const asyncHandler = () => {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async () => {}

// const asyncHandler = (fn) => async(req, res, next)=> {
//     try {
//         await fn(req,res,next)
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success : false,
//             message : error.message
//         })
//     }
// }


