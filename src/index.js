// require('dotenv').config({'.'})
import dotenv from 'dotenv'
import connectDB from './db/db.js';
import {app} from './app.js'


dotenv.config({
    path: './.env'
})


connectDB()
.then(()=> {
    app.listen(process.env.PORT || 3000, ()=>{
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err)=> 
    {console.log("MongoDB connection failed !!!", err);}
)



/*
const app = express()

;( async() => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (err)=>{
            console.log(err);
            throw err
        })

        app.listen(process.env.PORT , ()=> {
            console.log(`App is listening at ${process.env.PORT}`);
        })

    } catch (err) {
        console.error(err);
        throw err;
    }

})()
*/