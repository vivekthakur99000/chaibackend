import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from "../utils/ApiError.js"
import {User} from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { apiResponse } from '../utils/ApiResponse.js'

const registerUser = asyncHandler(async (req, res) => {
    /*
    steps to register the user 
    1. we will take the data from frontend 
    2. validation - not empty
    3. check if user already exist : username, email
    4. files checks - avatar, cover image
    5. upload them to cloudinary
    6. create user in database - user object, create entry in db 
    7. remove password and refresh token field from response
    8. response received or not - check 
    9. return response
    */

    const {fullname, username, email, password} = req.body

    console.log("email : " ,email);

    if(
        [fullname, email, username, password].some((field)=> field?.trim() === "" )
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = User.findOne({
        $or : [{username}, {email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with or email or username already exist")
    }

     const avatarLocalPath =  req.files?.avatar[0]?.path
     const coverImageLocalPath = req.files?.coverImage[0]?.path

     if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
     }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
     }

    const user =  await User.create({
        fullname, 
        avatar : avatar.url,
        coverimage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
     })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering user");
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "User registred successfully")
    )

})

export {registerUser}