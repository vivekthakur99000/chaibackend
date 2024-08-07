import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose  from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating and refresh token",
    );
  }
};

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

  const { fullname, username, email, password } = req.body;

  // console.log("email : " ,email);

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with or email or username already exist");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverimage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  return res
    .status(201)
    .json(new apiResponse(200, createdUser, "User registred successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  console.log(email);
  console.log(username);
  console.log(email);

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid User Credentails");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id,
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken",
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    },
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token ");
    }

    if (incomingRefreshToken != user?.refreshToken) {
      new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToke", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiError(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token generated successfully",
        ),
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new apiResponse(200, req.user, "User retrieved successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new ApiError(400, "Please provide all fields");
  }
  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(new apiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(new apiResponse(200, user, "Avatar uploaded successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const coverimage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverimage.url) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?.id,
    {
      $set: {
        coverimage: coverimage.url,
      },
    },
    { new: true },
  ).select("-password");

  return res
    .status(200)
    .json(new apiResponse(200, user, "cover iamge uploaded successfully"));
});

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if(!username?.trim()){
      throw new ApiError(400, "username is missing")
    }

    const channel = await User.Aggregate([
      {
        $match : {
          username : username?.toLowerCase()
        }
      },
      {
        $lookup : {
          from : "subscriptions",
          localField : "_id",
          foreignField : "channel"
        }
      },
       {
        $lookup : {
          from: "subcriptions",
          localField: "_id",
          foreignField : "subscriber",
          as : "subscribedTo"
        }
       }, {
        $addFields : {
          subscribersCount : {
            $size : "$subcribers"

          },
          channelsSubscribedToCount : {
            $size : "$subscribedTo"
          },
          isSubscriber : {
            $cond : {
              if : {$in : [req.user?._id, "$subcribers.subscriber"]},
              then : true,
              else : false
            } 
          }
        }
       },
       {
        $project : {
          fullname : 1,
          username : 1,
          subscribersCount : 1,
          channelsSubscribedToCount : 1,
          isSubscribed : 1,
          avatar : 1,
          coverImage : 1,
          email : 1,

        }
       }
      
    ])

    if(!channel?.length){
      throw new ApiError(404, "channel does not exist")
    }

    return res.status(200)
    .json(
      new apiResponse(200, channel[0], "User channel fetched succesfully")
    )



})

const getWatchHistory = asyncHandler(async(req, res) => {
  const  user  = await User.aggregate([
    {
      $match : {
        _id : new mongoose.Types.ObjectId(req.user._id)
      }
    }, 
    {
      $lookup : {
        from : "videos",
        localField : "watchhistory",
        foreignField : "_id",
        as : "watchHistory",
        pipeline : [
          {
            $lookup : {
              from : "users",
              localField : "owner",
              foreignField : "_id",
              as : "owner",
              pipeline : [
                {
                  $project : {
                    fullname : 1,
                    username : 1,
                    avatar : 1,
                  }
                }
              ]
            }
          }, {
            $addField : {
              owner : {
                $first : "$owner"
              }
            }
          }
        ]
    }
  }
  ])

  return res.status(200)
.json(new apiResponse(200,
  user[0].watchhistory,
  "watch history fetched successfully"
))
})



export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
