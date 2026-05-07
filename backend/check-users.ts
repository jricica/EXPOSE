import prisma from "./src/lib/prisma";

async function checkUsers() {
    console.log("Checking users in database...");
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                avatar_url: true
            }
        });
        console.log(JSON.stringify(users, null, 2));
    } catch (err) {
        console.error("❌ Failed to check users!");
        console.error(err);
    }
}

checkUsers();
