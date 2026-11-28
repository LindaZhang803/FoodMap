# FoodMap
Mobile App

## Project Description
FoodMap aims to help users easily discover restaurants and dishes worth trying in their area. Users can search for restaurants by location and view photos, ratings, and authentic reviews of specific dishes, enabling them to quickly find the food that interests them.

The application uses React Native and Expo for mobile development, Node.js and Express for backend services, and MongoDB Atlas for data storage.

## APP Features

### 1. Recommend Restaurants Based on Current Location
The system automatically detects the user's current location, with permission, and recommends nearby restaurants based on that location.

### 2. Restaurant Search Sorting
When searching for restaurants, users can sort and filter results based on various criteria, such as higher ratings, popularity, distance, or personal preferences.

- Rating
- Popularity
- Distance
- User Preference
- Price Range
- Cuisine Type

### 3. Review Classification and Integration System
- Users can choose to view only the overall reviews of a restaurant.
- Users can choose to view reviews for a specific dish only.
- Dish reviews can be sorted by the number of reviews.
- Dishes with more reviews can be displayed first.
- Comments with more likes can be displayed first.
- Restaurant ratings and dish ratings are managed separately.

### 4. User Accounts and Authentication
- Users can create an account and log in.
- Each user can manage their own reviews, ratings, uploaded photos, and favorite restaurants or dishes.
- User authentication protects account-related operations.

### 5. Restaurant and Dish Details
- Users can view restaurant names, addresses, cuisine types, ratings, and price ranges.
- Each restaurant can display its available dishes.
- Users can view dish names, descriptions, prices, images, and ratings.
- Restaurant and dish information is retrieved from the backend database.

### 6. Food Photo Uploads
- Users can select and upload food photos.
- Uploaded photos can be reviewed before becoming publicly visible.
- Restaurant and dish pages can display approved photos.

### 7. Personalized Food Discovery
- Users can save restaurants or dishes they are interested in.
- Users can maintain a list of foods they want to try.
- A random selection feature can help users decide what to eat.

## Team Members
- Linda Zhang (NetID: yzhan949)
- Qing Sun (NetID: qsun036)
- Suhyun Kim (NetID: skim1108)
- Steve Zang (NetID: szang005)

## Tech Stack
- **Mobile Frontend:** React Native, Expo, JavaScript
- **Backend Services:** Node.js, Express.js, REST API
- **Database:** MongoDB Atlas
- **Testing:** Jest, Jest Expo, React Native Testing Library, Node.js Test Runner
- **Version Control:** Git, GitHub

## Device Capabilities

FoodMap uses mobile device capabilities to improve the restaurant discovery experience.

- **Location Services:** Expo Location retrieves the user's current location with permission.
- **Photo Library:** Expo Image Picker allows users to select images from their devices.
- **Camera Access:** Expo Image Picker supports taking food photos when camera access is enabled.
- **Secure Storage:** Expo Secure Store supports storing sensitive local authentication data.
- **Network Access:** The application communicates with backend APIs to retrieve and update information.

## Feasibility Analysis

### Technical Feasibility
FoodMap uses React Native and Expo to support mobile application development. Node.js and Express handle backend requests, while MongoDB Atlas stores restaurant, dish, and user-related data.

These technologies support the project's main features without requiring the team to develop a separate native application for each platform.

### Economic Feasibility
The project is designed to minimize development costs by using open-source technologies and available free service tiers.

- React Native and Expo are free to use.
- Node.js and Express are open-source.
- MongoDB Atlas provides a free-tier option.
- OpenStreetMap provides restaurant location data.

Some services may have usage limits, but the project's development environment is designed to avoid unnecessary paid services.

### Schedule Feasibility
The project is divided into frontend development, backend development, database integration, and testing.

GitHub allows team members to develop different features simultaneously and merge their changes through version control.

## Testing Plan

FoodMap uses automated and manual testing to verify application functionality.

### 1. Unit Testing
Unit tests verify individual functions and components.

Examples include:
- Restaurant filtering
- Restaurant sorting
- Input validation
- Review-related logic
- Data processing functions

### 2. Integration Testing
Integration tests verify communication between different application components.

Examples include:
- Frontend and backend API communication
- Backend and MongoDB integration
- Restaurant and dish data retrieval
- User authentication workflows

### 3. Functional Testing
Functional testing verifies whether the application's main features behave as expected.

Examples include:
- Searching for restaurants
- Filtering restaurants by price and cuisine
- Sorting restaurants by rating and distance
- Viewing restaurant details
- Viewing dishes associated with a restaurant
- Submitting reviews
- Uploading photos

### 4. User Interface Testing
UI testing verifies that screens and components display correctly and respond to user interactions.

Testing includes:
- Screen navigation
- Button interactions
- Search and filtering interfaces
- Restaurant cards
- Restaurant detail screens
- Dish browsing screens

### 5. Automated Testing Commands

The following commands are available in `Mobile/package.json`.

Run all default Jest tests:

```bash
npm test
```

Run review module tests:

```bash
npm run test:reviews
```

Run feed module tests:

```bash
npm run test:feed
```

Run feed host tests:

```bash
npm run test:feed:host
```

All commands should be executed from the `Mobile` directory.

## Setup Instructions

### 1. Prerequisites

Install the following software before running FoodMap:

- [Node.js](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/go) or a compatible mobile simulator
- [MongoDB Atlas](https://www.mongodb.com/atlas) access

For iOS simulator testing, install Xcode on macOS.

For Android emulator testing, install Android Studio.

Verify Node.js and npm:

```bash
node -v
npm -v
```

### 2. Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/LindaZhang803/FoodMap.git
```

Navigate to the project:

```bash
cd FoodMap
```

### 3. Install Backend Dependencies

Navigate to the backend directory:

```bash
cd backend
```

Install the required dependencies:

```bash
npm install
```

The required backend packages will be installed automatically from `package.json`.

### 4. Configure MongoDB Atlas

The backend requires a MongoDB Atlas connection.

1. Obtain the MongoDB connection string from the project administrator.
2. Configure the backend's environment variables.
3. Make sure your IP address is permitted by MongoDB Atlas Network Access.
4. Confirm that the database connection is working.

If the backend uses a `.env` file, configure it using the variable names expected by the backend source code.

Example configuration:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
```

**Note:** `MONGODB_URI` is an example variable name. Check the backend source code for the exact required name.

Do not upload your `.env` file or database credentials to GitHub.

### 5. Start the Backend

Remain in the `backend` directory.

Check the available startup scripts:

```bash
npm run
```

If the backend defines a `start` script:

```bash
npm start
```

If it defines a `dev` script:

```bash
npm run dev
```

Use the command supported by the backend's `package.json`.

Keep this terminal open while running FoodMap.

If the backend is running on port 3000, you can test the restaurant API with:

```bash
curl http://localhost:3000/api/restaurants
```

### 6. Install Mobile Dependencies

Open a new terminal.

Navigate to the Mobile directory from the project root:

```bash
cd Mobile
```

Install the frontend dependencies:

```bash
npm install
```

This command installs all packages listed in `Mobile/package.json`, including React Native, Expo, and testing dependencies.

You do not need to install each package individually.

### 7. Configure the Backend API Address

Before starting the mobile application, verify that it uses the correct backend API address.

For local web development, the backend may be accessed through:

```text
http://localhost:3000
```

For testing on a physical phone, use your computer's local IP address.

Example:

```text
http://192.168.1.94:3000
```

Replace the example IP address with your computer's actual local IP address.

On macOS, you can check your Wi-Fi IP address using:

```bash
ipconfig getifaddr en0
```

Make sure the phone and computer are connected to the same network.

Update the frontend API configuration if the backend address changes.

### 8. Start the Mobile Application

From the `Mobile` directory, run:

```bash
npm start
```

Or:

```bash
npx expo start
```

Expo will start the development server.

Available commands:

**iOS Simulator:**

```bash
npm run ios
```

**Android Emulator:**

```bash
npm run android
```

**Web Browser:**

```bash
npm run web
```

**Clear Expo Cache:**

```bash
npx expo start -c
```

If using Expo Go, open the project using the connection options provided by Expo. Ensure that Expo Go supports the project's Expo SDK version.

### 9. Run the Complete Application

FoodMap requires the backend and mobile application to run separately.

**Terminal 1 — Backend**

```bash
cd FoodMap/backend
npm start
```

Use the correct backend startup command if it differs from `npm start`.

**Terminal 2 — Mobile**

```bash
cd FoodMap/Mobile
npm start
```

Once both servers are running, open the application in Expo Go or a mobile simulator.

### 10. Phase 2 Setup and Testing

Phase 2 development uses the project's source code, dependencies, and testing configuration.

First, install the required dependencies:

**Backend:**

```bash
cd backend
npm install
```

**Mobile:**

```bash
cd Mobile
npm install
```

Run the relevant automated tests from the `Mobile` directory:

```bash
npm test
```

```bash
npm run test:reviews
```

```bash
npm run test:feed
```

```bash
npm run test:feed:host
```

If Phase 2 includes additional standalone scripts or dependencies, follow the instructions in the corresponding Phase 2 files.

### 11. Troubleshooting

**Problem: `npm install` fails**

Check that Node.js and npm are installed correctly.

```bash
node -v
npm -v
```

**Problem: Expo fails to start**

Try clearing the Expo cache:

```bash
npx expo start -c
```

**Problem: The application cannot connect to the backend**

- Make sure the backend server is running.
- Verify the backend port.
- Check the frontend API address.
- Make sure the phone and computer are connected to the same network.

**Problem: MongoDB connection fails**

- Check the MongoDB connection string.
- Verify the database credentials.
- Check MongoDB Atlas Network Access.
- Confirm that the environment variables are configured correctly.

**Problem: Restaurant dishes are not displayed**

- Confirm that the restaurant exists in MongoDB.
- Verify that dish records use the correct `restaurantId`.
- Check that the backend returns dishes for the selected restaurant.
- Verify that the frontend requests the correct restaurant ID.

**Problem: Images are not displayed**

- Check that local image files exist.
- Verify image paths and mappings.
- Confirm that the image identifiers match the frontend configuration.

### 12. Important Notes

- Run `npm install` separately in `backend` and `Mobile` after cloning the repository.
- Start the backend before launching the mobile application.
- Keep the backend and Expo development servers running in separate terminals.
- Configure MongoDB Atlas credentials before using database-dependent features.
- Use your computer's local IP address when connecting from a physical phone.
- Never commit passwords, API secrets, or database credentials to GitHub.
- Reinstall dependencies when the project's dependency configuration changes.


## Weekly Report

[Google Slides Weekly Report:](https://docs.google.com/presentation/d/1OkTOl4TpcYL3UHjoc_G8q8kVhxQfkV5K83XzTRwetEY/edit?usp=sharing)
