# WorkPulse Backend API

A central API service for the WorkPulse attendance management system, built with Node.js, Express, and Sequelize.

## 🚀 Features

- **Staff Authentication**: Secure login and registration using JWT.
- **Leave Management**: Create, view, and manage leave requests with an approval workflow.
- **On-Duty (OD) Logs**: Track and approve official duty outside the office.
- **Admin Dashboard**: Comprehensive APIs for administrative tasks and overviews.
- **Activity Logging**: Detailed logs of administrative and user actions for audit trails.
- **API Documentation**: Integrated Swagger UI for easy exploration and testing.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: [Express.js](https://expressjs.com/) (v5.2.1)
- **ORM**: [Sequelize](https://sequelize.org/)
- **Database**: MySQL
- **Authentication**: JSON Web Token (JWT) & BcryptJS
- **Documentation**: [Swagger UI](https://swagger.io/tools/swagger-ui/)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher recommended)
- MySQL Server

## ⚙️ Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd wp_backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the following:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=workpulse_db
   JWT_SECRET=your_secret_key
   ```

## 🚀 Running the Application

- **Development Mode** (with nodemon):
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

Once running, the server will be available at `http://localhost:3000`.

## 📖 API Documentation

The API is fully documented using Swagger. You can access the interactive documentation at:
`http://localhost:3000/api-docs`

## 📂 Project Structure

```text
wp_backend/
├── config/         # Database and app configuration
├── controllers/    # Request handling logic
├── middleware/     # Custom Express middleware (e.g., Auth)
├── migrations/     # Database migration files
├── models/         # Sequelize data models
├── routes/         # API route definitions
├── utils/          # Helper functions and utilities
├── server.js       # Entry point of the application
└── swagger.js      # Swagger configuration
```

## 📜 License

This project is licensed under the [ISC License](LICENSE).
