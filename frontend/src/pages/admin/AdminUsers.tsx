import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";

// Define TypeScript interfaces
interface User {
  _id: string;
  email: string;
  role: string;
}

interface Goal {
  _id: string;
  title: string;
  description?: string;
}

interface UserGoal {
  goalId: string;
  completed: boolean;
  proof?: string;
  verified: boolean;
}

interface Certificate {
  _id: string;
  name: string;
  description: string;
  goals: Goal[];
  requirements: string[];
}

interface UserCertificate {
  _id: string;
  userId: User;
  certificateId: Certificate | null;
  goals: UserGoal[];
  progress: number;
  eligible: boolean;
  verified: boolean;
}

interface GroupedUserData {
  user: User;
  userCertificates: UserCertificate[];
}

interface GroupedByUser {
  [userId: string]: GroupedUserData;
}

export const AdminUsers = () => {
  const { user, token, loading: authLoading, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState([] as User[]);
  const [userCertificates, setUserCertificates] = useState(
    [] as UserCertificate[]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [expandedUser, setExpandedUser] = useState(null as string | null); // Track expanded user
  const [selectedProof, setSelectedProof] = useState(null as string | null); // Track selected proof for modal

  useEffect(() => {
    console.log(
      "AdminUsers.tsx - User:",
      user,
      "Token:",
      token,
      "Auth Loading:",
      authLoading
    );
    if (authLoading) {
      console.log("AdminUsers.tsx - Waiting for auth state to load...");
      return;
    }

    if (!user || !token || user.role !== "admin") {
      console.log(
        "AdminUsers.tsx - Redirecting to login: user, token, or role missing"
      );
      navigate("/login");
      return;
    }

    const fetchAllUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("http://localhost:5000/api/users/all", {
          // Ensure correct URL
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          signOut();
          navigate("/login");
          return;
        }

        if (!response.ok) {
          const errorText = await response.text(); // Log the response text for debugging
          console.error("Fetch users error response:", errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("AdminUsers.tsx - Fetched users:", data);
        if (data.success) {
          setUsers(data.users || []);
        } else {
          setError(data.message || "Failed to fetch users");
          setUsers([]);
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          setError("Invalid JSON response from server");
        } else {
          setError(error.message || "An error occurred while fetching users");
        }
        console.error("Fetch users error:", error);
        setUsers([]);
      }
    };

    const fetchUserCertificates = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/certificates/all",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          signOut();
          navigate("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(
          "AdminUsers.tsx - Fetched userCertificates:",
          data.userCertificates
        );
        if (data.success) {
          setUserCertificates(data.userCertificates || []);
        } else {
          setError(data.message || "Failed to fetch user certificates");
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          setError("Invalid JSON response from server");
        } else {
          setError(
            error.message ||
              "An error occurred while fetching user certificates"
          );
        }
        console.error("Fetch user certificates error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllUsers();
    fetchUserCertificates();
  }, [user, token, authLoading, navigate, signOut]);

  const handleVerify = async (certId: string, goalId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:5000/api/certificates/verify/${certId}/${goalId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        signOut();
        navigate("/login");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setUserCertificates((prevUserCertificates) =>
          prevUserCertificates.map((uc) =>
            uc._id === certId ? data.userCertificate : uc
          )
        );
      } else {
        setError(data.message || "Failed to verify goal");
      }
    } catch (error) {
      setError("An error occurred while verifying the goal");
      console.error("Verification error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowProof = (proof: string) => {
    setSelectedProof(proof);
  };

  const closeModal = () => {
    setSelectedProof(null);
  };

  const toggleUser = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  if (authLoading) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  if (!user || user.role !== "admin") {
    console.log(
      "AdminUsers.tsx - Rendering Unauthorized: user or role mismatch",
      user
    );
    return <div className="container mx-auto p-6">Unauthorized</div>;
  }

  // Group user certificates by user
  const groupedByUser: GroupedByUser = (users || []).reduce(
    (acc: GroupedByUser, user: User) => {
      const userId = user._id;
      acc[userId] = {
        user,
        userCertificates: userCertificates.filter(
          (uc) => uc.userId._id === userId
        ),
      };
      return acc;
    },
    {} as GroupedByUser
  );

  return (
    <div className="container mx-auto p-6 bg-gray-100 min-h-screen">
      {loading && <p className="text-blue-500 text-center">Loading...</p>}
      {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">
        Admin: User Certificates
      </h1>

      {Object.values(groupedByUser).length === 0 && !loading && (
        <p className="text-gray-600 text-center">No users found.</p>
      )}

      <div className="space-y-4">
        {Object.values(groupedByUser).map((userData: GroupedUserData) => (
          <div
            key={userData.user._id}
            className="bg-white rounded-lg shadow-md overflow-hidden"
          >
            {/* User Header */}
            <div
              className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
              onClick={() => toggleUser(userData.user._id)}
            >
              <h2 className="text-xl font-semibold text-gray-800">
                {userData.user.fullName || "Unknown User"} (
                {userData.user.email})
              </h2>
              <span className="text-gray-500">
                {expandedUser === userData.user._id ? "▲" : "▼"}
              </span>
            </div>

            {/* User Certificates (Collapsible) */}
            {expandedUser === userData.user._id && (
              <div className="p-4">
                {userData.userCertificates.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-600">
                      No certificates assigned to this user.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userData.userCertificates.map((userCert) => {
                      if (!userCert.certificateId) {
                        console.warn(
                          `AdminUsers.tsx - Certificate not found for UserCertificate ID: ${userCert._id}, User ID: ${userCert.userId._id}`
                        );
                        return (
                          <div
                            key={userCert._id}
                            className="bg-red-50 rounded-lg p-4"
                          >
                            <h3 className="text-xl font-medium mb-2 text-red-500">
                              Certificate Not Found
                            </h3>
                            <p className="text-gray-600">
                              The certificate associated with this user
                              certificate could not be found.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={userCert._id}
                          className="bg-gray-50 rounded-lg p-4 shadow-sm"
                        >
                          <h3 className="text-lg font-medium text-gray-800">
                            {userCert.certificateId.name}
                          </h3>
                          <p className="text-gray-600 mb-2">
                            {userCert.certificateId.description}
                          </p>
                          <p className="text-gray-600 mb-4">
                            Progress: {userCert.progress.toFixed(2)}%
                          </p>

                          {/* Goals Table */}
                          <div className="mt-4">
                            <h4 className="font-medium mb-2 text-gray-700">
                              Goals to Verify:
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="py-2 px-4 text-left text-gray-700">
                                      Goal
                                    </th>
                                    <th className="py-2 px-4 text-left text-gray-700">
                                      Status
                                    </th>
                                    <th className="py-2 px-4 text-left text-gray-700">
                                      Proof
                                    </th>
                                    <th className="py-2 px-4 text-left text-gray-700">
                                      Action
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {userCert.goals.map((userGoal, index) => {
                                    const goal =
                                      userCert.certificateId?.goals.find(
                                        (g) => g._id === userGoal.goalId
                                      );
                                    return (
                                      <tr
                                        key={userGoal.goalId}
                                        className="border-t border-gray-200 hover:bg-gray-50"
                                      >
                                        <td className="py-2 px-4 text-gray-600">
                                          {goal?.title || "Goal Not Found"}
                                        </td>
                                        <td className="py-2 px-4">
                                          <span
                                            className={
                                              userGoal.verified
                                                ? "text-green-500"
                                                : userGoal.completed
                                                ? "text-yellow-500"
                                                : "text-red-500"
                                            }
                                          >
                                            {userGoal.completed
                                              ? userGoal.verified
                                                ? "✅ Verified"
                                                : "⏳ Pending Verification"
                                              : "❌ Not Completed"}
                                          </span>
                                        </td>
                                        <td className="py-2 px-4">
                                          {userGoal.proof ? (
                                            userGoal.proof.includes(
                                              "application/pdf"
                                            ) ? (
                                              <a
                                                href={userGoal.proof}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline"
                                              >
                                                View PDF
                                              </a>
                                            ) : (
                                              <button
                                                onClick={() =>
                                                  handleShowProof(
                                                    userGoal.proof!
                                                  )
                                                }
                                                className="text-blue-500 hover:underline"
                                              >
                                                View Image
                                              </button>
                                            )
                                          ) : (
                                            <span className="text-gray-500">
                                              No proof uploaded
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-4">
                                          <button
                                            onClick={() =>
                                              handleVerify(
                                                userCert._id,
                                                userGoal.goalId
                                              )
                                            }
                                            disabled={
                                              userGoal.verified ||
                                              !userGoal.completed ||
                                              loading
                                            }
                                            className={`px-4 py-1 rounded text-sm font-medium transition ${
                                              userGoal.verified ||
                                              !userGoal.completed
                                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                                : "bg-blue-500 text-white hover:bg-blue-600"
                                            }`}
                                          >
                                            {userGoal.verified
                                              ? "Verified"
                                              : "Verify"}
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Pending Goals */}
                          <div className="mt-4">
                            <h4 className="font-medium mb-2 text-gray-700">
                              Pending Goals:
                            </h4>
                            <ul className="list-disc list-inside text-sm text-gray-600">
                              {userCert.goals
                                .filter(
                                  (userGoal) =>
                                    userGoal.completed && !userGoal.verified
                                )
                                .map((userGoal) => {
                                  const goal =
                                    userCert.certificateId?.goals.find(
                                      (g) => g._id === userGoal.goalId
                                    );
                                  return (
                                    <li key={userGoal.goalId}>
                                      {goal?.title || "Goal Not Found"}
                                    </li>
                                  );
                                })}
                              {userCert.goals.filter(
                                (userGoal) =>
                                  userGoal.completed && !userGoal.verified
                              ).length === 0 && <li>No pending goals</li>}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal for Viewing Proof Image */}
      {selectedProof && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-3xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">Proof Image</h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>
            <img
              src={selectedProof}
              alt="Proof"
              className="w-full h-auto rounded-lg max-h-[70vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
