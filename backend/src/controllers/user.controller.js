const getCurrentUser = (req, res) => {
  try {
    // req.user was added by auth middleware after JWT verification
    const user = req.user;

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // You could fetch user info from DB here if needed

    return res.status(200).json({ user });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};

module.exports = {
  getCurrentUser,
};
